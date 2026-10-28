import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { archStudio } from "../../data/architecture";
import { blankA64, type A64Cpu } from "../../engines/isaarch/arm";
import { ArmExperiment } from "./ArmExperiment";
import { ArmShell } from "./shell";
import { AssemblerPage, DatapathPage, EncodingPage, OverviewPage, PipelinePage, PracticePage, RegisterPage, SocPage } from "./pages";

const ALIAS: Record<string, string> = {
  loadstore: "memory", arith: "instruction-set", branches: "datapath", calls: "assembler", stack: "memory", flags: "registers", aarch64: "instruction-set", neon: "instruction-set",
};

const SAMPLE = `ADD X0, X1, X2
ADDS X3, X0, X0
LDR X4, [X1, #0]
B skip
ADD X5, X5, X5
skip:
BL done
done:
RET`;

export function ArmStudio() {
  useSimulatorCapture("studios/arm/ArmStudio.tsx:ArmStudio", () => ({ cpu: { ...cpu, mem: Array.from({ length: Math.ceil(cpu.mem.length / 256) }, (_, i) => ({ address: i * 256, bytes: Array.from(cpu.mem.slice(i * 256, (i + 1) * 256)) })) }, assemblerSource: source, sel, status }), "a64-experiments-2");

  const raw = useParams().labId ?? "overview";
  const lab = ALIAS[raw] ?? raw;
  const known = new Set(archStudio("arm")?.labs.map((item) => item.id));
  const [cpu, setCpu] = useState<A64Cpu>(() => {
    const next = blankA64();
    next.x[1] = 8n;
    next.x[2] = 7n;
    return next;
  });
  const [source, setSource] = useState(SAMPLE);
  const [sel, setSel] = useState(0);
  const [status, setStatus] = useState("Ready.");
  if (!known.has(lab)) return <Navigate to="/architecture/arm" replace />;
  const api = { cpu, setCpu, source, setSource, sel, setSel, status, setStatus };
  return (
    <ArmShell lab={lab}>
      {lab === "overview" && <OverviewPage api={api} />}
      {lab === "registers" && <><ArmExperiment key="flags" api={api} view="flags" /><RegisterPage api={api} /></>}
      {lab === "instruction-set" && <EncodingPage />}
      {lab === "assembler" && <AssemblerPage api={api} />}
      {lab === "datapath" && <DatapathPage api={api} />}
      {lab === "pipeline" && <PipelinePage />}
      {lab === "memory" && <ArmExperiment key="memory" api={api} view="memory" />}
      {lab === "exceptions" && <ArmExperiment key="exceptions" api={api} view="exceptions" />}
      {lab === "soc" && <SocPage />}
      {lab === "practice" && <PracticePage />}
    </ArmShell>
  );
}

export default ArmStudio;
