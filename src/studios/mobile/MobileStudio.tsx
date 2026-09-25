import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { MobileShell } from "./shell";
import { ConnectivityPage, CpuPage, GpuPage, HomePage, IntegrationPage, IspPage, MemoryPage, NpuPage, OverviewPage, PowerPage } from "./pages";

const ALIAS: Record<string, string> = {
  home: "home",
  overview: "overview",
  floorplan: "overview",
  cluster: "cpu-cores",
  cores: "cpu-cores",
  "cpu-cores": "cpu-cores",
  scheduler: "cpu-cores",
  gpu: "gpu",
  npu: "npu",
  camera: "isp",
  isp: "isp",
  media: "isp",
  memory: "memory",
  connectivity: "connectivity",
  modem: "connectivity",
  power: "power-thermal",
  thermal: "power-thermal",
  "power-thermal": "power-thermal",
  integration: "integration",
};

export function MobileStudio() {
  const raw = useParams().labId ?? "home";
  const lab = ALIAS[raw];
  const [resetKey, setResetKey] = useState(0);
  if (!lab) return <Navigate to="/architecture/mobile" replace />;
  return (
    <MobileShell lab={lab} onReset={() => setResetKey((value) => value + 1)}>
      <div key={resetKey}>
        {lab === "home" && <HomePage />}
        {lab === "overview" && <OverviewPage />}
        {lab === "cpu-cores" && <CpuPage />}
        {lab === "gpu" && <GpuPage />}
        {lab === "npu" && <NpuPage />}
        {lab === "isp" && <IspPage />}
        {lab === "memory" && <MemoryPage />}
        {lab === "connectivity" && <ConnectivityPage />}
        {lab === "power-thermal" && <PowerPage />}
        {lab === "integration" && <IntegrationPage />}
      </div>
    </MobileShell>
  );
}

export default MobileStudio;
